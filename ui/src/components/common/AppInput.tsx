import React from 'react';
import { Input } from 'antd';
import type { InputProps, InputRef } from 'antd';
import type { PasswordProps, SearchProps, TextAreaProps } from 'antd/es/input';

/** 禁用 macOS / WebView 句首自动大写、自动更正与拼写检查 */
const INPUT_SHIELD_PROPS = {
  autoCapitalize: 'off',
  autoCorrect: 'off',
  spellCheck: false,
} as const;

const AppInput = React.forwardRef<InputRef, InputProps>((props, ref) => (
  <Input ref={ref} {...INPUT_SHIELD_PROPS} {...props} />
));
AppInput.displayName = 'AppInput';

const AppInputSearch = React.forwardRef<InputRef, SearchProps>((props, ref) => (
  <Input.Search ref={ref} {...INPUT_SHIELD_PROPS} {...props} />
));
AppInputSearch.displayName = 'AppInput.Search';

const AppInputPassword = React.forwardRef<InputRef, PasswordProps>((props, ref) => (
  <Input.Password ref={ref} {...INPUT_SHIELD_PROPS} {...props} />
));
AppInputPassword.displayName = 'AppInput.Password';

const AppInputTextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>((props, ref) => (
  <Input.TextArea ref={ref} {...INPUT_SHIELD_PROPS} {...props} />
));
AppInputTextArea.displayName = 'AppInput.TextArea';

type AppInputComponent = typeof AppInput & {
  Search: typeof AppInputSearch;
  Password: typeof AppInputPassword;
  TextArea: typeof AppInputTextArea;
};

const AppInputWithVariants = AppInput as AppInputComponent;
AppInputWithVariants.Search = AppInputSearch;
AppInputWithVariants.Password = AppInputPassword;
AppInputWithVariants.TextArea = AppInputTextArea;

export default AppInputWithVariants;
