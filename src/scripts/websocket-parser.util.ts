import * as path from 'path';
import * as fs from 'fs';
import { Decorator, MethodDeclaration, Project, SyntaxKind } from 'ts-morph';
import { SocketGatewayInfo, SocketMessageInfo } from '../common/types';

function findFiles(dir: string, filter: RegExp): string[] {
  const files: string[] = [];
  const dirContent = fs.readdirSync(dir);
  for (const file of dirContent) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      files.push(...findFiles(filePath, filter));
    } else if (filter.test(file)) {
      files.push(filePath);
    }
  }
  return files;
}

export function parseWebSockets(projectPath: string): SocketGatewayInfo[] {
  const gateways: SocketGatewayInfo[] = [];

  const nestFiles = findFiles(projectPath, /\.(ts|js)$/)
    .filter(file => !file.includes('node_modules'));

  nestFiles.forEach(file => {
    const content = fs.readFileSync(file, 'utf-8');
    
    // Skip if it's a type definition file
    if (file.endsWith('.d.ts')) return;
    
    // More precise gateway detection
    const isGateway = (
      (content.includes('@WebSocketGateway') && 
       content.match(/class\s+\w+/)) ||
      content.includes('@SubscribeMessage(')
    );
    
    if (isGateway) {
      const nameMatch = content.match(/class\s+(\w+)/);
      const namespaceMatch = content.match(/@WebSocketGateway\(([^)]+)\)/);
      
      gateways.push({
        name: nameMatch?.[1] || 'UnknownGateway',
        path: path.relative(projectPath, file),
        namespace: namespaceMatch?.[1]?.replace(/['"]/g, '') || '/',
        type: 'nestjs-websocket'
      });
    }

    // CQRS Event Bus WebSocket detection
    if (
      content.includes('@CqrsWebSocketGateway') ||
      content.includes('CqrsWebSocketAdapter')
    ) {
      const nameMatch = content.match(/class\s+(\w+)/);

      gateways.push({
        name: nameMatch?.[1] || 'CqrsGateway',
        path: path.relative(projectPath, file),
        namespace: '/cqrs',
        type: 'cqrs-websocket',
      });
    }
  });

  return gateways;
}

function parseSubscribedMessage(
  method: MethodDeclaration,
  decorator: Decorator,
): SocketMessageInfo {
  const eventName =
    decorator.getArguments()[0]?.getText().replace(/['"]/g, '') ??
    'unknown-event';

  const bodyParam = method
    .getParameters()
    .find((p) => p.getDecorator('MessageBody'));
  const payload = bodyParam ? bodyParam.getType().getText(bodyParam) : 'any';

  const returnType = method.getReturnType().getText(method);
  const ack = returnType.includes('Promise<')
    ? returnType.replace('Promise<', '').replace('>', '')
    : returnType;

  return {
    eventName,
    payload,
    ack: ack !== 'void' ? ack : 'none',
  };
}

function parseEmittedEvents(method: MethodDeclaration): SocketMessageInfo[] {
  const emitted: SocketMessageInfo[] = [];
  const methodBody = method.getBody();

  if (methodBody) {
    const emitCalls = methodBody.getDescendantsOfKind(
      SyntaxKind.CallExpression,
    );
    for (const call of emitCalls) {
      const expression = call.getExpression();
      if (expression.getText().endsWith('.emit')) {
        const args = call.getArguments();
        if (args.length > 0) {
          const eventName = args[0].getText().replace(/['"]/g, '');
          const payload = args[1] ? args[1].getType().getText(args[1]) : 'any';
          emitted.push({ eventName, payload, ack: 'none' });
        }
      }
    }
  }

  return emitted;
}
