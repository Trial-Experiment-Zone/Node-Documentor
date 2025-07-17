import { Module } from '@nestjs/common';
import { DocumentationModule } from './documentation/documentation.module';
import { ConfigModule } from '@nestjs/config';
import { FileManagerModule } from './file-manager/file-manager.module';

@Module({
  imports: [
    DocumentationModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FileManagerModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
