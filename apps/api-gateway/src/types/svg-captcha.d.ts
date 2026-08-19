declare module 'svg-captcha' {
  export interface CaptchaOptions {
    size?: number;
    ignoreChars?: string;
    noise?: number;
    color?: boolean;
    background?: string;
    width?: number;
    height?: number;
    fontSize?: number;
  }

  export interface CaptchaData {
    text: string;
    data: string;
  }

  export function create(options?: CaptchaOptions): CaptchaData;

  const svgCaptcha: {
    create: typeof create;
  };

  export default svgCaptcha;
}
