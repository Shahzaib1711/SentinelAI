import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseStorage } from "./client";

export async function uploadBlueprintFile(
  eventSlug: string,
  file: File
): Promise<{ downloadUrl: string; firebasePath: string }> {
  const storage = getFirebaseStorage();
  const firebasePath = `blueprints/${eventSlug}/${Date.now()}-${file.name}`;
  const storageRef = ref(storage, firebasePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
  });

  const downloadUrl = await getDownloadURL(storageRef);
  return { downloadUrl, firebasePath };
}
