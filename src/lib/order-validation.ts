import { z } from 'zod'
import { digitsOnly } from '@/lib/format'

export const checkoutFormSchema = z.object({
  customer_name: z
    .string()
    .trim()
    .min(2, 'Informe seu nome (mínimo 2 caracteres)')
    .max(120, 'Nome muito longo'),
  customer_phone: z
    .string()
    .trim()
    .transform(digitsOnly)
    .pipe(z.string().min(10, 'Informe um WhatsApp válido').max(15, 'WhatsApp inválido')),
  customer_email: z
    .string()
    .trim()
    .email('Informe um e-mail válido')
    .max(254, 'E-mail muito longo'),
  notes: z.string().trim().max(500, 'Observação muito longa').optional(),
})

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>
