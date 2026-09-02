import { jest } from "@jest/globals";

jest.unstable_mockModule("../../src/models/message.js", () => {
    return {
        default: {
            find: jest.fn(),
        }
    };
});

const { getMessagesService } = await import("../../src/services/messageService.js");
const Message = (await import("../../src/models/message.js")).default;

describe("Message Service", () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    it("should fetch and reverse messages", async () => {
        const mockMessages = [{ _id: 1, text: "Older" }, { _id: 2, text: "Newer" }];
        
        // Mock chainable Mongoose methods
        const limitMock = jest.fn().mockResolvedValue(mockMessages);
        const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
        Message.find.mockReturnValue({ sort: sortMock });

        const result = await getMessagesService("userId1", "userId2", null, 50);

        expect(Message.find).toHaveBeenCalledWith({
            $or: [
                { senderId: "userId1", receiverId: "userId2" },
                { senderId: "userId2", receiverId: "userId1" },
            ]
        });
        
        // Output should be reversed
        expect(result).toEqual([{ _id: 2, text: "Newer" }, { _id: 1, text: "Older" }]);
    });
});
