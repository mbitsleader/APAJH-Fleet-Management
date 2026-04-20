import { Client } from 'ldapts';

export function isLdapEnabled(): boolean {
  return !!(
    process.env.LDAP_URL &&
    process.env.LDAP_BASE_DN &&
    process.env.LDAP_BIND_DN &&
    process.env.LDAP_BIND_PASSWORD
  );
}

// Escape special characters in LDAP filter values to prevent injection
function escapeLdapFilterValue(value: string): string {
  return value
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

export async function authenticateWithLdap(
  email: string,
  password: string
): Promise<{ dn: string; name: string; email: string } | null> {
  const client = new Client({
    url: process.env.LDAP_URL!,
    tlsOptions: {
      rejectUnauthorized: process.env.LDAP_TLS_REJECT_UNAUTHORIZED !== 'false',
      ca: process.env.LDAP_CA_CERT, // Pass raw PEM string if provided
    },
  });

  try {
    // 1. Bind with the service account to search for the user
    await client.bind(process.env.LDAP_BIND_DN!, process.env.LDAP_BIND_PASSWORD!);

    const searchBase = process.env.LDAP_USER_SEARCH_BASE || process.env.LDAP_BASE_DN!;
    const { searchEntries } = await client.search(searchBase, {
      scope: 'sub',
      filter: `(mail=${escapeLdapFilterValue(email)})`,
      attributes: ['dn', 'cn', 'mail', 'displayName'],
    });

    if (searchEntries.length === 0) return null;

    const entry = searchEntries[0];
    const userDn = entry.dn;

    await client.unbind();

    // 2. Re-bind as the user to verify their password
    await client.bind(userDn, password);

    return {
      dn: userDn,
      name: (entry.displayName as string) || (entry.cn as string) || email,
      email: (entry.mail as string) || email,
    };
  } catch {
    // Wrong password, user not found in AD, or AD unreachable
    return null;
  } finally {
    try { await client.unbind(); } catch {}
  }
}
