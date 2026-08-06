import { Global,Module } from '@nestjs/common';
import { ConfigModule ,ConfigService} from '@nestjs/config';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        return new Redis({
          host:configService.get<string>('REDIS_URL'),
          port:configService.get<number>('REDIS_PORT'),
        });
      },
    },
  ],
  exports: [REDIS_CLIENT],
})
export class RedisModule {}
