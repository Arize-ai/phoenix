import { ObjectMapping } from "../../src/types/data";
import { remapInput } from "../../src/utils/objectMappingUtls";

import { describe, expect, it } from "vitest";

describe("objectMappingUtls", () => {
  describe("remapInput", () => {
    const testData = {
      name: "John Doe",
      age: 30,
      email: "john@example.com",
      address: {
        street: "123 Main St",
        city: "New York",
        zipCode: "10001",
      },
      hobbies: ["reading", "swimming", "coding"],
      scores: [85, 92, 78, 96],
      metadata: {
        created: "2023-01-01",
        tags: ["user", "premium"],
        settings: {
          theme: "dark",
          notifications: true,
        },
      },
    };

    describe("function-based mapping", () => {
      it("should map values using functions", () => {
        const mapping: ObjectMapping<typeof testData> = {
          userName: (data) => data.name,
          userAge: (data) => data.age,
          upperCaseName: (data) => data.name.toUpperCase(),
        };

        const result = remapInput(testData, mapping);

        expect(result).toEqual({
          userName: "John Doe",
          userAge: 30,
          upperCaseName: "JOHN DOE",
        });
      });

      it("should handle complex function transformations", () => {
        const mapping: ObjectMapping<typeof testData> = {
          fullInfo: (data) => `${data.name} (${data.age})`,
          hobbyCount: (data) => data.hobbies.length,
          averageScore: (data) =>
            data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        };

        const result = remapInput(testData, mapping);

        expect(result).toEqual({
          fullInfo: "John Doe (30)",
          hobbyCount: 3,
          averageScore: 87.75,
        });
      });
    });

    describe("dot notation-based mapping", () => {
      it("should extract simple properties using dot notation", () => {
        const mapping: ObjectMapping<typeof testData> = {
          userName: "name",
          userAge: "age",
          userEmail: "email",
        };

        const result = remapInput(testData, mapping);

        expect(result).toEqual({
          userName: "John Doe",
          userAge: 30,
          userEmail: "john@example.com",
        });
      });

      it("should extract nested properties using dot notation", () => {
        const mapping: ObjectMapping<typeof testData> = {
          street: "address.street",
          city: "address.city",
          zipCode: "address.zipCode",
          theme: "metadata.settings.theme",
        };

        const result = remapInput(testData, mapping);

        expect(result).toEqual({
          street: "123 Main St",
          city: "New York",
          zipCode: "10001",
          theme: "dark",
        });
      });

      it("should extract array elements using dot notation", () => {
        const mapping: ObjectMapping<typeof testData> = {
          firstHobby: "hobbies[0]",
          lastHobby: "hobbies[2]", // Get the third element (index 2)
          secondScore: "scores[1]",
          firstTag: "metadata.tags[0]",
        };

        const result = remapInput(testData, mapping);

        expect(result).toEqual({
          firstHobby: "reading",
          lastHobby: "coding",
          secondScore: 92,
          firstTag: "user",
        });
      });

      it("should extract entire arrays using dot notation", () => {
        const mapping: ObjectMapping<typeof testData> = {
          allHobbies: "hobbies",
          allScores: "scores",
          allTags: "metadata.tags",
        };

        const result = remapInput(testData, mapping);

        expect(result).toEqual({
          allHobbies: ["reading", "swimming", "coding"],
          allScores: [85, 92, 78, 96],
          allTags: ["user", "premium"],
        });
      });

      it("should handle specific array element access using dot notation", () => {
        const mapping: ObjectMapping<typeof testData> = {
          firstHobby: "hobbies[0]",
          secondHobby: "hobbies[1]",
          thirdScore: "scores[2]",
          fourthScore: "scores[3]",
        };

        const result = remapInput(testData, mapping);

        expect(result).toEqual({
          firstHobby: "reading",
          secondHobby: "swimming",
          thirdScore: 78,
          fourthScore: 96,
        });
      });

      it("should handle nested array access using dot notation", () => {
        const mapping: ObjectMapping<typeof testData> = {
          firstTag: "metadata.tags[0]",
          secondTag: "metadata.tags[1]",
          notificationsEnabled: "metadata.settings.notifications",
        };

        const result = remapInput(testData, mapping);

        expect(result).toEqual({
          firstTag: "user",
          secondTag: "premium",
          notificationsEnabled: true,
        });
      });
    });

    describe("mixed mapping types", () => {
      it("should handle both function and dot notation mappings", () => {
        const mapping: ObjectMapping<typeof testData> = {
          // Dot notation extractions
          userName: "name",
          street: "address.street",
          firstHobby: "hobbies[0]",
          // Function-based transformations
          upperCaseName: (data) => data.name.toUpperCase(),
          hobbyCount: (data) => data.hobbies.length,
          isAdult: (data) => data.age >= 18,
        };

        const result = remapInput(testData, mapping);

        expect(result).toEqual({
          userName: "John Doe",
          street: "123 Main St",
          firstHobby: "reading",
          upperCaseName: "JOHN DOE",
          hobbyCount: 3,
          isAdult: true,
        });
      });
    });

    describe("edge cases", () => {
      it("should handle non-existent paths gracefully", () => {
        const mapping: ObjectMapping<typeof testData> = {
          nonExistent: "nonExistent",
          deepNonExistent: "address.nonExistent.deep",
          arrayOutOfBounds: "hobbies[10]",
        };

        const result = remapInput(testData, mapping);

        expect(result).toEqual({
          nonExistent: undefined,
          deepNonExistent: undefined,
          arrayOutOfBounds: undefined,
        });
      });

      it("should handle empty data object", () => {
        const emptyData = {};
        const mapping: ObjectMapping<typeof emptyData> = {
          anything: "anything",
          somethingElse: (data) => data,
        };

        const result = remapInput(emptyData, mapping);

        expect(result).toEqual({
          anything: undefined,
          somethingElse: {},
        });
      });

      it("should handle complex nested structures", () => {
        const complexData = {
          users: [
            { id: 1, name: "Alice", roles: ["admin", "user"] },
            { id: 2, name: "Bob", roles: ["user"] },
            { id: 3, name: "Charlie", roles: ["admin", "moderator"] },
          ],
          config: {
            app: {
              version: "1.0.0",
              features: {
                auth: true,
                notifications: false,
              },
            },
          },
        };

        const mapping: ObjectMapping<typeof complexData> = {
          // Use simpler JSONPath expressions that are more widely supported
          firstUserName: "$.users[0].name",
          secondUserName: "$.users[1].name",
          firstUserId: "$.users[0].id",
          allUserNames: "$.users[*].name",
          appVersion: "$.config.app.version",
          authEnabled: "$.config.app.features.auth",
          userCount: (data) => data.users.length,
        };

        const result = remapInput(complexData, mapping);

        expect(result).toEqual({
          firstUserName: "Alice",
          secondUserName: "Bob",
          firstUserId: 1,
          allUserNames: ["Alice", "Bob", "Charlie"],
          appVersion: "1.0.0",
          authEnabled: true,
          userCount: 3,
        });
      });
    });

    describe("type safety", () => {
      it("should maintain type safety with proper typing", () => {
        interface User extends Record<string, unknown> {
          id: number;
          profile: {
            name: string;
            email: string;
          };
          preferences: string[];
        }

        const userData: User = {
          id: 123,
          profile: {
            name: "Test User",
            email: "test@example.com",
          },
          preferences: ["dark-mode", "notifications"],
        };

        const mapping: ObjectMapping<User> = {
          userId: "$.id",
          userName: "$.profile.name",
          userEmail: "$.profile.email",
          firstPreference: "$.preferences[0]",
          fullName: (data) => data.profile.name,
        };

        const result = remapInput(userData, mapping);

        expect(result).toEqual({
          userId: 123,
          userName: "Test User",
          userEmail: "test@example.com",
          firstPreference: "dark-mode",
          fullName: "Test User",
        });
      });
    });
  });
});
