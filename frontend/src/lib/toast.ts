import { toast } from "sonner";

export function toastSuccess(message: string) {
  toast.success(message);
}

export function toastError(message: string) {
  toast.error(message);
}

export function toastApiError(message: string) {
  toast.error(message || "Action failed. Please try again.");
}
