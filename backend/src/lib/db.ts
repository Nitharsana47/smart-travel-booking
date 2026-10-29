import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()

/** Today's date in India (YYYY-MM-DD), so "past date" checks match what travellers see. */
export const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export const rupeesToPaise = (r: number) => Math.round(r * 100)
