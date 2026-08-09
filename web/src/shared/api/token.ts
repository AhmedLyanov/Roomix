let getAccessToken: (() => Promise<string | null>) | null = null;

export function setAccessTokenGetter(getter: () => Promise<string | null>) {
  getAccessToken = getter;
}

export async function getAccessTokenValue() {
  if (!getAccessToken) {
    return null;
  }

  return getAccessToken();
}
