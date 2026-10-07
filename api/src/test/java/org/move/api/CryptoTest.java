package org.move.api;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Base64;
import org.junit.jupiter.api.Test;

class CryptoTest {
  Crypto crypto = new Crypto(Base64.getEncoder().encodeToString(new byte[32]));

  @Test
  void roundTripAndRandomIv() {
    String value = "Sensitive information";
    String one = crypto.encryptText(value), two = crypto.encryptText(value);
    assertNotEquals(one, two);
    assertEquals(value, crypto.decryptText(one));
  }

  @Test
  void rejectsWrongKeyTamperingAndInvalidKey() {
    byte[] encrypted = crypto.encrypt(new byte[] {1, 2, 3});
    encrypted[encrypted.length - 1] ^= 1;
    assertThrows(IllegalStateException.class, () -> crypto.decrypt(encrypted));
    assertThrows(IllegalArgumentException.class, () -> new Crypto("AAAA"));
  }
}
