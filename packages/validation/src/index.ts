import { z } from "zod";

export const MAX_IMAGE_BYTES = 100 * 1024;
export const imageMimeTypes = ["image/png", "image/jpeg", "image/webp"] as const;

export const stimulusImportSchema = z.object({
  stimulus_code: z.string().min(1),
  title: z.string().min(1),
  stimulus_type: z.enum(["TEXT", "IMAGE", "TABLE", "AUDIO", "TEXT_IMAGE", "TEXT_TABLE", "TEXT_AUDIO", "MIXED"]),
  language: z.string().default("id"),
  instructions_html: z.string().default(""),
  stimulus_text_html: z.string().default(""),
  image_file: z.string().optional(),
  audio_file: z.string().optional(),
  source: z.string().optional(),
  copyright_note: z.string().optional(),
  expected_questions: z.coerce.number().int().min(1).max(100).optional(),
  notes_html: z.string().optional()
});

export const questionImportSchema = z.object({
  question_code: z.string().min(1),
  stimulus_code: z.string().optional(),
  order_in_stimulus: z.coerce.number().int().min(1).optional(),
  blueprint_code: z.string().min(1),
  question_html: z.string().min(1),
  option_a_html: z.string().min(1),
  option_b_html: z.string().min(1),
  option_c_html: z.string().min(1),
  option_d_html: z.string().min(1),
  option_e_html: z.string().min(1),
  answer_key: z.enum(["A", "B", "C", "D", "E"]),
  explanation_html: z.string().optional(),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
  question_image: z.string().optional(),
  notes_html: z.string().optional()
}).superRefine((value, context) => {
  if (value.stimulus_code && !value.order_in_stimulus) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["order_in_stimulus"],
      message: "Urutan wajib diisi untuk soal yang menggunakan stimulus."
    });
  }
});

export function validateImageMetadata(input: { size: number; type: string }) {
  return z.object({
    size: z.number().max(MAX_IMAGE_BYTES, "Gambar maksimum 100 KB."),
    type: z.enum(imageMimeTypes)
  }).parse(input);
}
