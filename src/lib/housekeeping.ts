import { countryOfIp } from "@/lib/geo-country";
import { prisma } from "@/lib/prisma";
import { SESSION_RETENTION_DAYS, USER_IP_RETENTION_DAYS } from "@/lib/retention";

// The daily tidy-up behind the privacy policy's "IP addresses are deleted a
// year after we last saw them", plus filling in the country of addresses that
// were recorded without one (the rows copied from old sign-ins by the
// migration, or any whose lookup failed at the time).

const DAY_MS = 86_400_000;

const COUNTRY_PAGE = 500;
const COUNTRY_MAX_ROWS = 5000;

export type HousekeepingResult = {
  dryRun: boolean;
  /** Addresses not seen for a year (deleted unless this is a dry run). */
  oldAddresses: number;
  /** Sign-in records not used for a year (deleted unless this is a dry run). */
  oldSessions: number;
  /** Addresses whose country was filled in this run. */
  countriesFilled: number;
  /** Addresses that still have no country (not in the database). */
  countriesUnknown: number;
};

export async function runHousekeeping(options: { dryRun?: boolean; now?: Date } = {}): Promise<HousekeepingResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;
  const addressCutoff = new Date(now.getTime() - USER_IP_RETENTION_DAYS * DAY_MS);
  const sessionCutoff = new Date(now.getTime() - SESSION_RETENTION_DAYS * DAY_MS);

  const oldAddresses = dryRun
    ? await prisma.userIp.count({ where: { lastSeenAt: { lt: addressCutoff } } })
    : (await prisma.userIp.deleteMany({ where: { lastSeenAt: { lt: addressCutoff } } })).count;

  const oldSessions = dryRun
    ? await prisma.userSession.count({ where: { lastSeenAt: { lt: sessionCutoff } } })
    : (await prisma.userSession.deleteMany({ where: { lastSeenAt: { lt: sessionCutoff } } })).count;

  let countriesFilled = 0;
  let countriesUnknown = 0;
  if (dryRun) {
    countriesUnknown = await prisma.userIp.count({ where: { country: null } });
  } else {
    // Page through the rows with no country by id, so addresses that are simply
    // not in the database can't keep the rest from being reached.
    let cursor: string | undefined;
    let seen = 0;
    while (seen < COUNTRY_MAX_ROWS) {
      const page = await prisma.userIp.findMany({
        where: { country: null },
        orderBy: { id: "asc" },
        take: COUNTRY_PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, ip: true },
      });
      if (page.length === 0) break;
      for (const row of page) {
        const country = await countryOfIp(row.ip);
        if (country) {
          await prisma.userIp.update({ where: { id: row.id }, data: { country } });
          countriesFilled += 1;
        } else {
          countriesUnknown += 1;
        }
      }
      seen += page.length;
      cursor = page[page.length - 1].id;
      if (page.length < COUNTRY_PAGE) break;
    }
  }

  console.log(
    `[Housekeeping] dry=${dryRun} oldAddresses=${oldAddresses} oldSessions=${oldSessions} ` +
      `countriesFilled=${countriesFilled} countriesUnknown=${countriesUnknown}`,
  );
  return { dryRun, oldAddresses, oldSessions, countriesFilled, countriesUnknown };
}
