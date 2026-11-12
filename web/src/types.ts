import type { Timestamp } from "firebase/firestore";

export type Role = "Admin" | "Designer";
export const STATUSES = ["To Do", "In Progress", "In Review", "Revisions", "Approved"] as const;
export type Status = (typeof STATUSES)[number];
export const DESIGNER_STATUSES: Status[] = ["To Do", "In Progress", "In Review"];
export const PRIORITIES = ["High", "Medium", "Low"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface UserProfile {
  id: string; name: string; email: string; role: Role; photoURL?: string | null; active?: boolean;
}
export interface Invite { id: string; email: string; name?: string; role: Role }
export interface Campaign {
  id: string; name: string; label: string; color: string; description: string; objective: string;
  ownerId: string; coverFileId?: string; createdAt?: Timestamp;
}
export interface Task {
  id: string; campaignId: string; title: string; assigneeId: string; priority: Priority; due: string;
  status: Status; copy: string; instructions: string; format: string; submission: string;
  fileId?: string; fileName?: string; fileMime?: string; feedback: string; hours: number;
  createdAt?: Timestamp; updatedAt?: Timestamp;
}
export interface Annotation {
  id: string; x: number; y: number; text: string; authorName: string; authorUid: string;
  resolved: boolean; createdAt?: Timestamp; resolvedAt?: Timestamp;
}
export interface Activity { id: string; text: string; campaignId: string | null; actorUid: string; createdAt?: Timestamp }
export interface Notification {
  id: string; toUid: string; fromUid: string; taskId: string | null; message: string; read: boolean; createdAt?: Timestamp;
}
