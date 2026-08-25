import { db } from "@/lib/db";

export type Interests = {
  architecture: number;
  food: number;
  nature: number;
  nightlife: number;
  shopping: number;
};

export type ParsedProfile = {
  id: string;
  travelStyle: string;
  budgetPreference: string;
  walkingTolerance: string;
  interests: Interests;
};

export async function getTravelerProfile(
  userId: string
): Promise<ParsedProfile | null> {
  const profile = await db.travelerProfile.findUnique({ where: { userId } });
  if (!profile) return null;

  return {
    id: profile.id,
    travelStyle: profile.travelStyle,
    budgetPreference: profile.budgetPreference,
    walkingTolerance: profile.walkingTolerance,
    interests: JSON.parse(profile.interests) as Interests,
  };
}
