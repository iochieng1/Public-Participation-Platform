import type { PrismaClient } from '@prisma/client';
import { COUNTIES, PILOT_WARDS } from './geo-data.js';

export async function seedGeography(prisma: PrismaClient) {
  for (const [id, name] of COUNTIES) {
    await prisma.county.upsert({ where: { id }, update: { name }, create: { id, name } });
  }
  for (const [countyId, subCounties] of Object.entries(PILOT_WARDS)) {
    for (const [scName, wards] of Object.entries(subCounties)) {
      const sc = await prisma.subCounty.upsert({
        where: { countyId_name: { countyId: Number(countyId), name: scName } },
        update: {},
        create: { countyId: Number(countyId), name: scName },
      });
      for (const name of wards) {
        await prisma.ward.upsert({
          where: { subCountyId_name: { subCountyId: sc.id, name } },
          update: {},
          create: { subCountyId: sc.id, name },
        });
      }
    }
  }
}
