import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from './firebase';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  url: string;
  path: string;
  name: string;
}

export const uploadFile = async (
  file: File,
  boardId: string,
  userId: string
): Promise<UploadResult> => {
  const fileExtension = file.name.split('.').pop();
  const fileName = `${uuidv4()}.${fileExtension}`;
  const filePath = `boards/${boardId}/${userId}/${fileName}`;
  
  const storageRef = ref(storage, filePath);
  
  await uploadBytes(storageRef, file, {
    contentType: file.type,
  });
  
  const url = await getDownloadURL(storageRef);
  
  return {
    url,
    path: filePath,
    name: file.name,
  };
};

export const uploadFromPaste = async (
  dataUrl: string,
  boardId: string,
  userId: string
): Promise<UploadResult> => {
  // Convert data URL to blob
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  
  const fileName = `${uuidv4()}.png`;
  const filePath = `boards/${boardId}/${userId}/${fileName}`;
  
  const storageRef = ref(storage, filePath);
  
  await uploadBytes(storageRef, blob, {
    contentType: 'image/png',
  });
  
  const url = await getDownloadURL(storageRef);
  
  return {
    url,
    path: filePath,
    name: 'Pasted Image',
  };
};

export const deleteFile = async (filePath: string): Promise<void> => {
  const storageRef = ref(storage, filePath);
  await deleteObject(storageRef);
};

export const isImageFile = (file: File): boolean => {
  return file.type.startsWith('image/');
};

export const getFileType = (file: File): 'image' | 'file' => {
  return isImageFile(file) ? 'image' : 'file';
};
