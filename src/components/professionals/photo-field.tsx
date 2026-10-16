"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface PhotoFieldProps {
  currentPhotoUrl?: string | null;
  error?: string[] | undefined;
  initials?: string;
}

export function PhotoField({
  currentPhotoUrl,
  error,
  initials = "DR",
}: PhotoFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removed, setRemoved] = useState<boolean>(false);

  const activePhoto = previewUrl || (!removed ? currentPhotoUrl : null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setRemoved(false);
    }
  };

  const handleRemove = () => {
    setPreviewUrl(null);
    setRemoved(true);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleChoose = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="photo">Foto de perfil (opcional)</Label>

      {/* Input de archivo real */}
      <input
        ref={fileInputRef}
        id="photo"
        name="photo"
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={handleFileChange}
        aria-describedby={error?.length ? "photo-error" : undefined}
      />

      {/* Referencias para edición */}
      {currentPhotoUrl && (
        <input type="hidden" name="currentPhoto" value={currentPhotoUrl} />
      )}
      <input
        type="hidden"
        name="removePhoto"
        value={removed ? "true" : "false"}
      />

      <div className="flex items-center gap-4">
        {/* Contenedor del Avatar / Preview circular */}
        <div className="relative size-20 sm:size-24 rounded-full overflow-hidden border-2 border-border bg-tray flex items-center justify-center shrink-0 shadow-sm">
          {activePhoto ? (
            <Image
              src={activePhoto}
              alt="Foto de perfil"
              fill
              className="object-cover"
              sizes="96px"
              unoptimized={Boolean(previewUrl)}
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              {initials ? (
                <span className="text-title-lg font-bold text-primary">
                  {initials}
                </span>
              ) : (
                <User className="size-8 text-muted-foreground" />
              )}
            </div>
          )}
        </div>

        {/* Botones de acción y ayuda */}
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleChoose}
            >
              <Camera className="size-4 mr-1.5" />
              {activePhoto ? "Cambiar foto" : "Seleccionar foto"}
            </Button>
            {activePhoto && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive hover:bg-destructive-soft"
                onClick={handleRemove}
              >
                <Trash2 className="size-4 mr-1.5" />
                Quitar
              </Button>
            )}
          </div>
          <p className="text-body-sm text-muted-foreground">
            JPG, PNG o WebP. Máximo 10 MB.
          </p>
        </div>
      </div>

      {error?.[0] && (
        <p id="photo-error" className="text-body-sm text-destructive">
          {error[0]}
        </p>
      )}
    </div>
  );
}
