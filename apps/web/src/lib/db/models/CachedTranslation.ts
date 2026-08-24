import mongoose, { Schema, Document } from 'mongoose';

export interface ICachedTranslation extends Document {
  hash: string;
  artist: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  lyrics: {
    index: number;
    timeMs: number;
    durationMs: number;
    original: string;
    translated: string;
  }[];
  createdAt: Date;
  updatedAt: Date;
  flaggedInaccurate: boolean;
}

const CachedTranslationSchema = new Schema<ICachedTranslation>(
  {
    hash: { type: String, required: true, unique: true, index: true },
    artist: { type: String, required: true },
    title: { type: String, required: true },
    sourceLanguage: { type: String, required: true },
    targetLanguage: { type: String, required: true },
    lyrics: [
      {
        index: { type: Number, required: true },
        timeMs: { type: Number, required: true },
        durationMs: { type: Number, required: true },
        original: { type: String, required: true },
        translated: { type: String, required: true },
      },
    ],
    flaggedInaccurate: { type: Boolean, default: false },
  },
  { timestamps: true }
);

CachedTranslationSchema.index({ artist: 1, title: 1, targetLanguage: 1 });
CachedTranslationSchema.index({ createdAt: -1 });

export const CachedTranslation =
  mongoose.models.CachedTranslation ||
  mongoose.model<ICachedTranslation>('CachedTranslation', CachedTranslationSchema);
