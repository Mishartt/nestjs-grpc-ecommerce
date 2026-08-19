import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  AUTH_SERVICE,
  AUTH_SERVICE_NAME,
  AuthServiceClient,
  LoginRequest,
  RegisterRequest,
} from '@app/common';

@Injectable()
export class AuthService implements OnModuleInit {
  private authClient!: AuthServiceClient;

  constructor(@Inject(AUTH_SERVICE) private client: ClientGrpc) {}

  onModuleInit() {
    this.authClient =
      this.client.getService<AuthServiceClient>(AUTH_SERVICE_NAME);
  }

  register(data: RegisterRequest){
    return firstValueFrom(this.authClient.register(data));
  }

  login(data: LoginRequest){
    return firstValueFrom(this.authClient.login(data));
  }

  getMe(id: string) {
    return firstValueFrom(this.authClient.getMe({ id }));
  }
}