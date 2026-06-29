export interface DispatcherData {
  incidentType?: string;
  transportType?: string | null;
  routes?: string[];
  location?: string | null;
  direction?: string | null;
}

export interface PassengerData {
  isDelayQuestion: boolean;
  transportType?: string | null;
  route?: string | null;
  routes?: string[];
  direction?: string | null;
  location?: string | null;
}

export interface ResolutionData {
  transportType?: string | null;
  routes?: string[];
  location?: string | null;
}
