// src/common/types.ts

export interface MethodInfo {
  name: string;
  docs: string; // Contains signature, inputs, outputs
}

export interface PropertyInfo {
  name: string;
  type: string;
  decorators: string[];
}

export interface ClassInfo {
  name: string | undefined;
  filePath: string;
  docs: string;
  methods: MethodInfo[];
  properties: PropertyInfo[];
}

export interface FunctionInfo {
  name: string;
  method: string; // e.g., GET, POST
  route: string; // e.g., /users/:id
  docs: string; // e.g., Input: (...), Output: ...
  returnType: string;
}

// The complete parsed data from any analyzer
export interface ParsedProjectData {
  name: string;
  path: string;
  type: string;
  [key: string]: any;
}

// Data needed to build the ERD
export interface EntityRelationship {
  from: string;
  to: string;
  type: 'OneToOne' | 'OneToMany' | 'ManyToOne' | 'ManyToMany';
}

export interface IdentifiedFlow {
  keyword: string;
  filePath: string;
  relevantCode: string;
}

export interface FlowSummary {
  type: string;
  resource: string;
  description: string;
  endpoints: string[];
}

// --- WebSocket Types ---

export interface SocketMessageInfo {
  eventName: string;
  payload: string;
  ack: string;
}

export interface SocketGatewayInfo {
  name: string;
  path: string;
  namespace: string;
  type: 'nestjs-websocket' | 'cqrs-websocket';
  subscribedMessages?: SocketMessageInfo[];
  emittedEvents?: SocketMessageInfo[];
}
