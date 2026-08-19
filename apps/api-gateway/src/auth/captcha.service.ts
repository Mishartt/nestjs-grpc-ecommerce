import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import svgCaptcha from 'svg-captcha';

type CaptchaEntry = {
  text: string;
  expiresAt: number;
};

@Injectable()
export class CaptchaService {
  private readonly store = new Map<string, CaptchaEntry>();
  private readonly ttlMs = 5 * 60 * 1000;

  generate() {
    this.cleanup();

    const captcha = svgCaptcha.create({
      size: 5,
      noise: 2,
      ignoreChars: '0o1ilI',
      color: true,
      background: '#f4f4f5',
    });

    const captchaId = randomUUID();
    this.store.set(captchaId, {
      text: captcha.text.toLowerCase(),
      expiresAt: Date.now() + this.ttlMs,
    });

    return {
      captchaId,
      image: `data:image/svg+xml;base64,${Buffer.from(captcha.data).toString('base64')}`,
    };
  }

  verify(captchaId: string, answer: string) {
    const entry = this.store.get(captchaId);
    this.store.delete(captchaId);

    if (!entry || entry.expiresAt < Date.now()) {
      throw new BadRequestException('CAPTCHA expired, please refresh');
    }

    if (entry.text !== answer.trim().toLowerCase()) {
      throw new BadRequestException('Invalid CAPTCHA');
    }
  }

  private cleanup() {
    const now = Date.now();
    for (const [id, entry] of this.store) {
      if (entry.expiresAt < now) {
        this.store.delete(id);
      }
    }
  }
}
