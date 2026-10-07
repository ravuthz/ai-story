import { useState } from "react";
import { keys, useAction } from "@/hooks/queries";
import { href } from "@/hooks/useRoute";
import { api } from "@/lib/api";
import { TextField } from "./fields";
import { FormDialog } from "./FormDialog";

export function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const create = useAction(api.createProject, { success: "Project created", invalidate: [keys.projects] });

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="New project"
      description="Stories, images, audios and videos are stored per project."
      submitLabel="Create"
      pending={create.isPending}
      disabled={!name.trim()}
      onSubmit={() =>
        create.mutate(
          { name: name.trim(), description },
          {
            onSuccess: (project) => {
              onOpenChange(false);
              setName("");
              setDescription("");
              window.location.hash = href.project(project.id);
            },
          },
        )
      }
    >
      <TextField label="Name" value={name} onChange={setName} placeholder="Khmer Horror Shorts" />
      <TextField label="Description" value={description} onChange={setDescription} multiline rows={2} />
    </FormDialog>
  );
}
