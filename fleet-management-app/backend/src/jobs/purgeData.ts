import prisma from '../services/prisma';
import logger from '../lib/logger';

/**
 * Purge data older than 5 years (Data Retention Policy)
 * This script permanently deletes records where 'deletedAt' is set and older than 5 years.
 */
export async function purgeSoftDeletedData() {
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);

  logger.info({ threshold: fiveYearsAgo }, 'Starting data purge job...');

  try {
    // Delete old soft-deleted users
    const deletedUsers = await prisma.user.deleteMany({
      where: {
        deletedAt: {
          lt: fiveYearsAgo,
          not: null,
        },
      },
    });

    // Delete old soft-deleted vehicles
    const deletedVehicles = await prisma.vehicle.deleteMany({
      where: {
        deletedAt: {
          lt: fiveYearsAgo,
          not: null,
        },
      },
    });

    logger.info(
      { deletedUsers: deletedUsers.count, deletedVehicles: deletedVehicles.count },
      'Data purge complete.'
    );
  } catch (error) {
    logger.error({ error }, 'Data purge job failed');
  }
}

// If run directly
if (require.main === module) {
  purgeSoftDeletedData()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
