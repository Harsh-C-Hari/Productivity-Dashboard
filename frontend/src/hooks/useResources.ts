import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ResourceLinkInput } from "@/types";
import { useNotifications } from "@/context/NotificationContext";
import { STUDY_HUB_SUMMARY_KEY } from "./useStudyHub";

export const RESOURCES_KEY = ["resources"] as const;

export function useResources(params?: { subjectId?: string; topicId?: string; resourceType?: string }) {
  return useQuery({
    queryKey: [...RESOURCES_KEY, params ?? {}],
    queryFn: () => api.getResources(params),
  });
}

function useInvalidateResources() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: RESOURCES_KEY });
    qc.invalidateQueries({ queryKey: STUDY_HUB_SUMMARY_KEY });
  };
}

export function useCreateResourceLink() {
  const invalidate = useInvalidateResources();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (payload: ResourceLinkInput) => api.createResourceLink(payload),
    onSuccess: (resource) => {
      invalidate();
      toast(`Added link "${resource.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't add link", "error"),
  });
}

export function useUploadResourceFile() {
  const invalidate = useInvalidateResources();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (params: { subjectId: string; title: string; topicId?: string | null; file: File }) =>
      api.uploadResourceFile(params),
    onSuccess: (resource) => {
      invalidate();
      toast(`Uploaded "${resource.title}"`, "success");
    },
    onError: (err: Error) => toast(err.message || "Couldn't upload file", "error"),
  });
}

export function useUpdateResource() {
  const invalidate = useInvalidateResources();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { title?: string; topic_id?: string; external_url?: string; clear_topic?: boolean };
    }) => api.updateResource(id, payload),
    onSuccess: () => invalidate(),
    onError: (err: Error) => toast(err.message || "Couldn't update resource", "error"),
  });
}

export function useDeleteResource() {
  const invalidate = useInvalidateResources();
  const { toast } = useNotifications();
  return useMutation({
    mutationFn: (id: string) => api.deleteResource(id),
    onSuccess: () => {
      invalidate();
      toast("Resource removed", "info");
    },
    onError: (err: Error) => toast(err.message || "Couldn't remove resource", "error"),
  });
}
