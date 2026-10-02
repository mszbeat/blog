import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './user/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisModule } from './redis/redis.module';
import { PostModule } from './posts/post.module';
import { CategoriesModule } from './categoriy/categories.module';
import { CommentModule } from './comment/comment.module';
import { UploadsModule } from './uploads/uploads.module';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { SocialModule } from './social/social.module';
import { NotificationModule } from './notification/notification.module';
import { ThrottlerModule } from '@nestjs/throttler/dist/throttler.module';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from './logger/logger.module';

@Module({
  imports: [
    // Global logging infrastructure — must be first so every other module can
    // inject AppLoggerService/AuditService during its own construction.
    LoggerModule,
    ThrottlerModule.forRoot([
      {
        // Was ttl:60 / limit:10 — far too strict for a social feed: a single
        // page render plus a notification poll exhausts it instantly.
        // Endpoints that are polled on a timer use @SkipThrottle() instead.
        ttl: 60_000,
        limit: 120,
      },
    ]),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
      }),
    }),
    UsersModule,
    AuthModule,
    RedisModule,
    PostModule,
    CategoriesModule,
    CommentModule,
    UploadsModule,
    CloudinaryModule,
    SocialModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    AppService,
  ],
})
export class AppModule {}
