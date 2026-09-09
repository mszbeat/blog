import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';
import { UsersModule } from '../user/users.module';

@Module({
  imports: [UsersModule],
  controllers: [UploadsController],
  providers: [UploadsService],
})
export class UploadsModule {}