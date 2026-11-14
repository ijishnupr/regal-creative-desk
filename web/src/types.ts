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
export type Stage = "Upcoming" | "Active";
export interface Campaign {
  id: string; name: string; label: string; color: string; description: string; objective: string;
  ownerId: string; coverFileId?: string; createdAt?: Timestamp;
  /** "Upcoming" campaigns become active automatically on startDate (yyyy-mm-dd). Missing = Active. */
  stage?: Stage; startDate?: string; endDate?: string;
}
export interface LinkItem { label: string; url: string }
export interface Task {
  id: string; campaignId: string; title: string; assigneeId: string; priority: Priority; due: string;
  status: Status; copy: string; instructions: string; format: string; submission: string;
  feedback: string; hours: number;
  /** Reference links for the brief (admin). */
  references?: LinkItem[];
  /** Final file links: Google Drive link, screenshot link… (designer/admin). */
  deliverables?: LinkItem[];
  /** Legacy: files uploaded before links replaced task uploads. */
  fileId?: string; fileName?: string; fileMime?: string;
  createdAt?: Timestamp; updatedAt?: Timestamp;
}
export interface Message {
  id: string; text: string; authorUid: string; authorName: string; createdAt?: Timestamp;
}
export interface Activity { id: string; text: string; campaignId: string | null; actorUid: string; createdAt?: Timestamp }
export interface Notification {
  id: string; toUid: string; fromUid: string; taskId: string | null; message: string; read: boolean; createdAt?: Timestamp;
}

const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
/** Upcoming until its start date arrives (or an admin starts it early). */
export function isUpcoming(c: Campaign) {
  return c.stage === "Upcoming" && !!c.startDate && c.startDate > todayISO();
}
export function daysUntil(iso?: string) {
  if (!iso) return null;
  return Math.round((new Date(iso + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / 864e5);
}
