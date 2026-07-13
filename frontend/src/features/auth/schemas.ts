import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(150, 'Too long'),
    email: z.string().min(1, 'Email is required').email('Enter a valid email').max(255),
    phone: z
      .string()
      .max(20, 'Too long')
      .optional()
      .or(z.literal('')),
    password: z.string().min(8, 'At least 8 characters').max(100, 'Too long'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type RegisterValues = z.infer<typeof registerSchema>
