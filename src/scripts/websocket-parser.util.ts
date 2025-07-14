import * as path from 'path';
import * as fs from 'fs';
import { Decorator, MethodDeclaration, Project, SyntaxKind } from 'ts-morph';
import { SocketGatewayInfo, SocketMessageInfo } from '../common/types';

export function parseWebSockets(projectPath: string): SocketGatewayInfo[] {
  // Only run if tsconfig.json exists in the projectPath
  const tsConfigPath = path.join(projectPath, 'tsconfig.json');
  if (!fs.existsSync(tsConfigPath)) {
    // Not a TypeScript project, skip
    return [];
  }
  const project = new Project({
    tsConfigFilePath: tsConfigPath,
    skipAddingFilesFromTsConfig: true,
  });
  project.addSourceFilesAtPaths(path.join(projectPath, 'src/**/*.ts'));

  const gateways: SocketGatewayInfo[] = [];

  const sourceFiles = project.getSourceFiles();

  for (const file of sourceFiles) {
    const gatewayClasses = file
      .getClasses()
      .filter((cls) =>
        cls.getDecorators().some((d) => d.getName() === 'WebSocketGateway'),
      );

    for (const gatewayClass of gatewayClasses) {
      const gatewayInfo: SocketGatewayInfo = {
        name: gatewayClass.getName() ?? 'UnnamedGateway',
        filePath: file.getFilePath(),
        subscribedMessages: [],
        emittedEvents: [],
      };

      const methods = gatewayClass.getMethods();
      for (const method of methods) {
        const subscribeDecorator = method.getDecorator('SubscribeMessage');
        if (subscribeDecorator) {
          gatewayInfo.subscribedMessages.push(
            parseSubscribedMessage(method, subscribeDecorator),
          );
        }
        gatewayInfo.emittedEvents.push(...parseEmittedEvents(method));
      }

      // Deduplicate emitted events
      gatewayInfo.emittedEvents = gatewayInfo.emittedEvents.filter(
        (event, index, self) =>
          index === self.findIndex((e) => e.eventName === event.eventName),
      );

      gateways.push(gatewayInfo);
    }
  }

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
