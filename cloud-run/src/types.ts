export interface Signal {
  id: string;
  source: string;
  type: string;
  severity: number;
  location: {
    lat: number;
    lng: number;
  };
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface FusedSignal {
  id: string;
  signals: string[]; // Array of Signal IDs
  confidence: number;
  inferredLocation: {
    lat: number;
    lng: number;
  };
  timestamp: string;
}

export interface Crisis {
  id: string;
  type: string;
  status: 'active' | 'resolved' | 'mitigated';
  severity: number;
  description: string;
  location: {
    lat: number;
    lng: number;
  };
  startTime: string;
  fusedSignalIds: string[];
}

export interface ResourceInventory {
  id: string;
  type: string;
  quantity: number;
  location: {
    lat: number;
    lng: number;
  };
  status: 'available' | 'deployed' | 'maintenance';
}

export interface Allocation {
  id: string;
  crisisId: string;
  resourceId: string;
  quantity: number;
  status: 'pending' | 'active' | 'completed';
  dispatchedAt: string;
}

export interface Alert {
  id: string;
  crisisId: string;
  message: string;
  severity: number;
  targetAudience: string[];
  issuedAt: string;
}

export interface AgentTrace {
  id: string;
  agentId: string;
  action: string;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  confidence: number;
  timestamp: string;
  crisisId?: string;
}
