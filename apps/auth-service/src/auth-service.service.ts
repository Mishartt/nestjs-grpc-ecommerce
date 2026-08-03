import { AuthResponse, LoginRequest, RegisterRequest, User } from '@app/common';
import { UserRole } from '@app/common/constants/roles';
import { status } from '@grpc/grpc-js';
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { RpcException } from '@nestjs/microservices';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { UserEntity } from './entities/user.entity';

@Injectable()
export class AuthServiceService {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
  ) {}

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const email = data.email.toLowerCase().trim();

    if (!email || !data.password) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Email and password are required',
      });
    }

    const existing = await this.usersRepo.findOne({ where: { email } });
    if (existing) {
      throw new RpcException({
        code: status.ALREADY_EXISTS,
        message: 'User already exists',
      });
    }

    const user = await this.usersRepo.save(
      this.usersRepo.create({
        email,
        passwordHash: await bcrypt.hash(data.password, 10),
        role: email === 'admin@test.com' ? UserRole.ADMIN : UserRole.USER,
      }),
    );

    return this.toAuthResponse(user);
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const email = data.email.toLowerCase().trim();

    if (!email || !data.password) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: 'Email and password are required',
      });
    }

    const user = await this.usersRepo.findOne({ where: { email } });

    if (!user) {
      throw new RpcException({
        code: status.NOT_FOUND,
        message: 'User not found',
      });
    }

    const ok = await bcrypt.compare(data.password, user.passwordHash);
    if (!ok) {
      throw new RpcException({
        code: status.UNAUTHENTICATED,
        message: 'Invalid credentials',
      });
    }

    return this.toAuthResponse(user);
  }

  private toAuthResponse(user: UserEntity): AuthResponse {
    const publicUser: User = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      accessToken,
      user: publicUser,
    };
  }
}
