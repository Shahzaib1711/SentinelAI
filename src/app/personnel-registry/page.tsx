"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crown, Loader2, Shield, Trash2, Upload, UserPlus, Users } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeader, LoadingState } from "@/components/shared/PageElements";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { enrollmentApi, type EnrolledPerson, type EnrolledRole } from "@/lib/api/enrollment";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: { value: EnrolledRole; label: string; icon: React.ElementType }[] = [
  { value: "guard", label: "Security Guard", icon: Shield },
  { value: "vip", label: "VIP", icon: Crown },
  { value: "staff", label: "Staff", icon: Users },
  { value: "contractor", label: "Contractor", icon: Users },
];

export default function PersonnelRegistryPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [personnel, setPersonnel] = useState<EnrolledPerson[]>([]);

  const [name, setName] = useState("");
  const [designation, setDesignation] = useState("");
  const [role, setRole] = useState<EnrolledRole>("guard");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await enrollmentApi.list();
      setPersonnel(res.personnel);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load registry");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload a JPG or PNG portrait photo");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setError("Photo must be under 4MB");
      return;
    }
    setError(null);
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read photo"));
      reader.readAsDataURL(file);
    });
    setPhotoPreview(dataUrl);
    setPhotoDataUrl(dataUrl);
  };

  const handleEnroll = async () => {
    if (!name.trim() || !designation.trim() || !photoDataUrl) {
      setError("Name, designation, and a clear face photo are required");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await enrollmentApi.enroll({
        name: name.trim(),
        designation: designation.trim(),
        role,
        photoUrl: photoDataUrl,
      });
      setPersonnel((prev) => [res.person, ...prev]);
      setName("");
      setDesignation("");
      setRole("guard");
      setPhotoPreview(null);
      setPhotoDataUrl(null);
      setSuccess(`${res.person.name} enrolled — face profile saved for live recognition`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enrollment failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await enrollmentApi.remove(id);
      setPersonnel((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AppLayout title="Personnel Registry" subtitle="Face enrollment for guards & VIPs">
        <LoadingState message="Loading personnel registry..." />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Personnel Registry" subtitle="Face enrollment for guards & VIPs">
      <PageHeader
        title="Staff & VIP Registry"
        description="Upload portrait photos so live cameras can recognize who is who by face"
      />

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm text-green-300">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="soc-panel lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <UserPlus className="h-4 w-4 text-cyan-400" />
              Enroll Person
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="flex w-full flex-col items-center rounded-lg border border-dashed border-border/60 p-4 hover:border-cyan-500/40"
              onClick={() => fileRef.current?.click()}
            >
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoPreview}
                  alt="Portrait preview"
                  className="h-32 w-32 rounded-full object-cover ring-2 ring-cyan-500/40"
                />
              ) : (
                <Upload className="h-10 w-10 text-muted-foreground/40" />
              )}
              <p className="mt-2 text-xs font-medium">
                {photoPreview ? "Replace portrait" : "Upload portrait photo"}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Front-facing, good lighting · Max 4MB
              </p>
            </button>

            <Input
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Input
              placeholder="Designation (e.g. Head of Security)"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
            />
            <Select value={role} onValueChange={(v) => setRole(v as EnrolledRole)}>
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button className="w-full" disabled={saving} onClick={() => void handleEnroll()}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              Save face profile
            </Button>
          </CardContent>
        </Card>

        <Card className="soc-panel lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">
              Enrolled ({personnel.length}) — recognized on live feeds
            </CardTitle>
          </CardHeader>
          <CardContent>
            {personnel.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No staff enrolled yet. Add guards and VIPs with portrait photos.
              </p>
            ) : (
              <ul className="space-y-3">
                {personnel.map((person) => {
                  const roleMeta = ROLE_OPTIONS.find((r) => r.value === person.role);
                  const Icon = roleMeta?.icon ?? Users;
                  return (
                    <li
                      key={person.id}
                      className="flex items-center gap-4 rounded-lg border border-border/50 bg-background/40 p-3"
                    >
                      {person.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={person.photoUrl}
                          alt={person.name}
                          className="h-14 w-14 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted">
                          <Icon className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{person.name}</p>
                        <p className="text-xs text-muted-foreground">{person.designation}</p>
                        <span
                          className={cn(
                            "mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                            person.role === "guard" && "bg-purple-500/20 text-purple-300",
                            person.role === "vip" && "bg-yellow-500/20 text-yellow-300",
                            person.role === "staff" && "bg-cyan-500/20 text-cyan-300",
                            person.role === "contractor" && "bg-slate-500/20 text-slate-300"
                          )}
                        >
                          {person.role}
                        </span>
                        {!person.enrolled && (
                          <span className="ml-2 text-[10px] text-red-400">No face data</span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={saving}
                        onClick={() => void handleDelete(person.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
