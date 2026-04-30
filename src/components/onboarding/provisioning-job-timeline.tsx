import { Badge } from "@/components/ui/badge";
import { JOB_STATUS_CONFIG, type JobStatus } from "@/types";
import { Play, RotateCcw, UserMinus, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ProvisioningJob {
  id: string;
  status: JobStatus;
  jobType: string;
  startedAt: string | null;
  completedAt: string | null;
  metadata: Record<string, unknown>;
}

interface ProvisioningJobTimelineProps {
  jobs: ProvisioningJob[];
}

export function ProvisioningJobTimeline({ jobs }: ProvisioningJobTimelineProps) {
  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
        <p className="text-sm text-muted-foreground">No provisioning jobs yet</p>
      </div>
    );
  }

  const jobTypeIcons: Record<string, typeof Play> = {
    onboarding: Play,
    retry: RotateCcw,
    offboarding: UserMinus,
  };

  return (
    <div className="space-y-3">
      {jobs.map((job) => {
        const statusConfig = JOB_STATUS_CONFIG[job.status] || JOB_STATUS_CONFIG.pending;
        const Icon = jobTypeIcons[job.jobType] || Play;

        return (
          <div
            key={job.id}
            className="flex items-start gap-3 p-3 rounded-lg border bg-card"
          >
            <div className="mt-0.5">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium capitalize">
                  {job.jobType} Job
                </span>
                <Badge variant="outline" className={statusConfig.color}>
                  {statusConfig.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {job.startedAt && (
                  <span>
                    Started{" "}
                    {formatDistanceToNow(new Date(job.startedAt), {
                      addSuffix: true,
                    })}
                  </span>
                )}
                {job.completedAt && (
                  <span>
                    · Completed{" "}
                    {formatDistanceToNow(new Date(job.completedAt), {
                      addSuffix: true,
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
