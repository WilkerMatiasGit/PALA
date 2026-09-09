import argon2 from 'argon2';

export async function hashSenha(plain) {
  return argon2.hash(plain);
}

export async function verifySenha(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}
