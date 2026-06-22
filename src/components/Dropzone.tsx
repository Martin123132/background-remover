import { ImagePlus, UploadCloud } from "lucide-react";
import type { DragEvent } from "react";

type DropzoneProps = {
  disabled?: boolean;
  onFiles: (files: File[]) => void;
};

export function Dropzone({ disabled = false, onFiles }: DropzoneProps) {
  const acceptFiles = (fileList: FileList | null) => {
    if (!fileList || disabled) return;

    const images = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    onFiles(images);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    acceptFiles(event.dataTransfer.files);
  };

  return (
    <label
      className="dropzone"
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <input
        type="file"
        accept="image/*"
        multiple
        disabled={disabled}
        onChange={(event) => acceptFiles(event.target.files)}
      />
      <span className="dropzone-icon">
        <UploadCloud size={26} />
      </span>
      <span className="dropzone-title">Drop images here</span>
      <span className="dropzone-copy">
        Product shots, portraits, marketplace photos, and creator thumbnails.
      </span>
      <span className="dropzone-button">
        <ImagePlus size={18} />
        Choose images
      </span>
    </label>
  );
}
