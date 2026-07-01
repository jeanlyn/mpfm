use chrono::Utc;
use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

const EMPTY_PAYLOAD_HASH: &str = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

fn hex_encode(bytes: impl AsRef<[u8]>) -> String {
    bytes
        .as_ref()
        .iter()
        .map(|b| format!("{:02x}", b))
        .collect()
}

fn sha256_hex(data: &str) -> String {
    hex_encode(Sha256::digest(data.as_bytes()))
}

fn hmac_sha256(key: &[u8], data: &str) -> Vec<u8> {
    let mut mac = HmacSha256::new_from_slice(key).expect("HMAC key length");
    mac.update(data.as_bytes());
    mac.finalize().into_bytes().to_vec()
}

fn signing_key(secret_key: &str, date_stamp: &str, region: &str) -> Vec<u8> {
    let k_date = hmac_sha256(format!("AWS4{secret_key}").as_bytes(), date_stamp);
    let k_region = hmac_sha256(&k_date, region);
    let k_service = hmac_sha256(&k_region, "s3");
    hmac_sha256(&k_service, "aws4_request")
}

fn sign_get_authorization(
    host: &str,
    region: &str,
    access_key: &str,
    secret_key: &str,
) -> (String, String, String) {
    let now = Utc::now();
    let amz_date = now.format("%Y%m%dT%H%M%SZ").to_string();
    let date_stamp = now.format("%Y%m%d").to_string();

    let canonical_headers = format!(
        "host:{host}\nx-amz-content-sha256:{EMPTY_PAYLOAD_HASH}\nx-amz-date:{amz_date}\n"
    );
    let signed_headers = "host;x-amz-content-sha256;x-amz-date";
    let canonical_request = format!(
        "GET\n/\n\n{canonical_headers}\n{signed_headers}\n{EMPTY_PAYLOAD_HASH}"
    );

    let credential_scope = format!("{date_stamp}/{region}/s3/aws4_request");
    let string_to_sign = format!(
        "AWS4-HMAC-SHA256\n{amz_date}\n{credential_scope}\n{}",
        sha256_hex(&canonical_request)
    );

    let signature = hex_encode(hmac_sha256(
        &signing_key(secret_key, &date_stamp, region),
        &string_to_sign,
    ));

    let authorization = format!(
        "AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, \
         SignedHeaders={signed_headers}, Signature={signature}"
    );

    (amz_date, EMPTY_PAYLOAD_HASH.to_string(), authorization)
}

fn build_list_buckets_url(region: &str, endpoint: Option<&str>) -> String {
    match endpoint {
        Some(ep) => ep.trim_end_matches('/').to_string(),
        None if region == "us-east-1" => "https://s3.amazonaws.com".to_string(),
        None => format!("https://s3.{region}.amazonaws.com"),
    }
}

fn parse_host(url: &str) -> String {
    let without_scheme = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .unwrap_or(url);
    without_scheme
        .split('/')
        .next()
        .unwrap_or(without_scheme)
        .to_string()
}

fn parse_bucket_names(xml: &str) -> Vec<String> {
    let mut names = Vec::new();
    let mut rest = xml;
    while let Some(start) = rest.find("<Name>") {
        rest = &rest[start + 6..];
        if let Some(end) = rest.find("</Name>") {
            names.push(rest[..end].to_string());
            rest = &rest[end..];
        } else {
            break;
        }
    }
    names
}

pub async fn list_s3_buckets(
    region: &str,
    endpoint: Option<&str>,
    access_key: &str,
    secret_key: &str,
) -> Result<Vec<String>, String> {
    let base_url = build_list_buckets_url(region, endpoint);
    let host = parse_host(&base_url);
    let url = format!("{}/", base_url.trim_end_matches('/'));

    let (amz_date, payload_hash, authorization) =
        sign_get_authorization(&host, region, access_key, secret_key);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("x-amz-date", &amz_date)
        .header("x-amz-content-sha256", &payload_hash)
        .header("Authorization", authorization)
        .send()
        .await
        .map_err(|e| format!("请求失败: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("列举 bucket 失败 ({status}): {body}"));
    }

    let xml = response.text().await.map_err(|e| format!("读取响应失败: {e}"))?;
    Ok(parse_bucket_names(&xml))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_bucket_names_extracts_names() {
        let xml = r#"<ListAllMyBucketsResult>
            <Buckets>
                <Bucket><Name>alpha</Name></Bucket>
                <Bucket><Name>beta</Name></Bucket>
            </Buckets>
        </ListAllMyBucketsResult>"#;
        assert_eq!(
            parse_bucket_names(xml),
            vec!["alpha".to_string(), "beta".to_string()]
        );
    }

    #[test]
    fn build_list_buckets_url_for_aws() {
        assert_eq!(
            build_list_buckets_url("us-east-1", None),
            "https://s3.amazonaws.com"
        );
        assert_eq!(
            build_list_buckets_url("ap-southeast-1", None),
            "https://s3.ap-southeast-1.amazonaws.com"
        );
    }
}
