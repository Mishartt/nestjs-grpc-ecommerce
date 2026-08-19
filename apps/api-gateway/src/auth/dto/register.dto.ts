import { IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';
import { AuthCredentialsDto } from './auth-credentials.dto';

export class RegisterDto extends AuthCredentialsDto {
  @IsUUID()
  captchaId!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9]+$/)
  captcha!: string;
}
