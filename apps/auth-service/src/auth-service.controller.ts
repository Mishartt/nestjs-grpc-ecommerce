import { Controller } from '@nestjs/common';
import {
  AuthServiceControllerMethods,
  AuthServiceController as IAuthServiceController,
  LoginRequest,
  RegisterRequest,
} from '@app/common';
import { AuthServiceService } from './auth-service.service';

@Controller()
@AuthServiceControllerMethods()
export class AuthServiceController implements IAuthServiceController {
  constructor(private readonly authService: AuthServiceService) {}

  register(request: RegisterRequest) {
    return this.authService.register(request);
  }

  login(request: LoginRequest) {
    return this.authService.login(request);
  }

  getMe(request: { id: string }) {
    return this.authService.getMe(request.id);
  }
}