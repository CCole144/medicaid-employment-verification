package org.move.api;

import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.spec.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class Crypto {
  private final SecretKeySpec key;
  private final SecureRandom random = new SecureRandom();

  public Crypto(@Value("${move.encryption-key}") String encodedKey) {
    byte[] bytes = Base64.getDecoder().decode(encodedKey);
    if (bytes.length != 32)
      throw new IllegalArgumentException("MOVE_ENCRYPTION_KEY must be a Base64 32-byte key.");
    key = new SecretKeySpec(bytes, "AES");
  }

  public byte[] encrypt(byte[] bytes) {
    try {
      byte[] iv = new byte[12];
      random.nextBytes(iv);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
      byte[] encrypted = cipher.doFinal(bytes);
      return ByteBuffer.allocate(iv.length + encrypted.length).put(iv).put(encrypted).array();
    } catch (Exception e) {
      throw new IllegalStateException("Encryption failed.", e);
    }
  }

  public byte[] decrypt(byte[] bytes) {
    try {
      ByteBuffer buffer = ByteBuffer.wrap(bytes);
      byte[] iv = new byte[12];
      buffer.get(iv);
      byte[] encrypted = new byte[buffer.remaining()];
      buffer.get(encrypted);
      Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
      cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
      return cipher.doFinal(encrypted);
    } catch (Exception e) {
      throw new IllegalStateException("Decryption failed; check the encryption key.", e);
    }
  }

  public String encryptText(String text) {
    return Base64.getEncoder().encodeToString(encrypt(text.getBytes(StandardCharsets.UTF_8)));
  }

  public String decryptText(String text) {
    return new String(decrypt(Base64.getDecoder().decode(text)), StandardCharsets.UTF_8);
  }
}
