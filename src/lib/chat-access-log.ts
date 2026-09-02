import { prisma } from "@/lib/prisma";
import { ensureChatAccessLogSchema } from "@/lib/ensure-chat-access-log";

export async function logChatAccess(adminId: bigint, requestId: bigint) {
  await ensureChatAccessLogSchema();
  await prisma.chat_access_log.create({
    data: {
      admin_id: adminId,
      request_id: requestId,
      opened_at: new Date(),
    },
  });
}
