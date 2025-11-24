// Main API client exports - centralized access point

// Export types
export type { ApiError } from "./base";
// Export all API clients
export { BaseApiClient } from "./base";
export {
  FollowUpApiClient,
  followUpApiClient,
  followUpKeys,
  useCreateFollowUp,
  useDeleteFollowUp,
  useFollowUp,
  useFollowUps,
  useUpdateFollowUp,
} from "./follow-ups";
export { MetricApiClient, metricApiClient, useMetric } from "./metrics";
export {
  SlideApiClient,
  slideApiClient,
  slideKeys,
  useCreateSlide,
  useDeleteSlide,
  usePrefetchSlide,
  useSlide,
  useUpdateSlide,
} from "./slides";
export {
  SubmetricApiClient,
  submetricApiClient,
  useUpdateTrafficLightColor,
} from "./submetrics";
export { UserApiClient, userApiClient, userKeys, useUsers } from "./users";
// Export all hooks
export {
  useCreateWorkspace,
  useDeleteWorkspace,
  usePrefetchWorkspace,
  useUpdateWorkspace,
  useWorkspace,
  useWorkspaceSlidesList,
  useWorkspaces,
  WorkspaceApiClient,
  workspaceApiClient,
  workspaceKeys,
} from "./workspaces";

// Legacy compatibility - create a combined client for backward compatibility
import { BaseApiClient } from "./base";
import { FollowUpApiClient } from "./follow-ups";
import { MetricApiClient } from "./metrics";
import { SlideApiClient } from "./slides";
import { WorkspaceApiClient } from "./workspaces";

export class ApiClient extends BaseApiClient {
  public workspaces: WorkspaceApiClient;
  public slides: SlideApiClient;
  public metrics: MetricApiClient;
  public followUps: FollowUpApiClient;

  constructor(baseUrl: string = "") {
    super(baseUrl);
    this.workspaces = new WorkspaceApiClient(baseUrl);
    this.slides = new SlideApiClient(baseUrl);
    this.metrics = new MetricApiClient(baseUrl);
    this.followUps = new FollowUpApiClient(baseUrl);
  }

  // Legacy methods for backward compatibility
  async getAllWorkspaces() {
    return this.workspaces.getAllWorkspaces();
  }

  async getWorkspaceById(workspaceId: string) {
    return this.workspaces.getWorkspaceById(workspaceId);
  }

  async getSlideById(slideId: string) {
    return this.slides.getSlideById(slideId);
  }

  async createWorkspace(data: any) {
    return this.workspaces.createWorkspace(data);
  }

  async createSlide(workspaceId: string, data: any) {
    return this.slides.createSlide(workspaceId, data);
  }

  async createMetric(slideId: string, data: any) {
    return this.metrics.createMetric(slideId, data);
  }
}

// Default client instance for backward compatibility
export const apiClient = new ApiClient();
