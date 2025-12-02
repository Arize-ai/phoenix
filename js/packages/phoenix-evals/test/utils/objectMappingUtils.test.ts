import { ObjectMapping } from "../../src/types/data";
import { remapObject } from "../../src/utils/objectMappingUtils";

import { describe, expect, it } from "vitest";

describe("objectMappingUtils", () => {
  describe("remapObject", () => {
    const testData = {
      id: 123,
      name: "John Doe",
      age: 30,
      email: "john@example.com",
      address: {
        street: "123 Main St",
        city: "New York",
        zipCode: "10001",
        country: "USA",
      },
      hobbies: ["reading", "swimming", "coding"],
      scores: [85, 92, 78, 96],
      metadata: {
        created: "2023-01-01",
        tags: ["user", "premium"],
        settings: {
          theme: "dark",
          notifications: true,
          language: "en",
        },
      },
      isActive: true,
      lastLogin: "2023-12-01",
    };

    describe("data preservation with mapping", () => {
      it("should preserve original data and add mapped fields", () => {
        const mapping: ObjectMapping<typeof testData> = {
          userName: "name",
          userAge: "age",
        };

        const result = remapObject(testData, mapping);

        // Result should contain all original fields plus the mapped fields
        expect(result).toEqual({
          ...testData, // All original fields preserved
          userName: "John Doe", // Added mapped field
          userAge: 30, // Added mapped field
        });
      });

      it("should handle empty mapping by returning original data", () => {
        const mapping: ObjectMapping<typeof testData> = {};

        const result = remapObject(testData, mapping);

        // Should return exact copy of original data
        expect(result).toEqual(testData);
      });

      it("should overwrite existing fields when mapping to same key", () => {
        const mapping: ObjectMapping<typeof testData> = {
          name: "email", // Overwrite name with email value
          newField: "age", // Add new field
        };

        const result = remapObject(testData, mapping);

        expect(result).toEqual({
          ...testData,
          name: "john@example.com", // Overwritten
          newField: 30, // Added
        });
      });
    });

    describe("dot notation extraction", () => {
      it("should extract simple properties using dot notation", () => {
        const mapping: ObjectMapping<typeof testData> = {
          extractedName: "name",
          extractedEmail: "email",
          extractedActive: "isActive",
        };

        const result = remapObject(testData, mapping);

        expect(result).toEqual({
          ...testData,
          extractedName: "John Doe",
          extractedEmail: "john@example.com",
          extractedActive: true,
        });
      });

      it("should extract nested properties using dot notation", () => {
        const mapping: ObjectMapping<typeof testData> = {
          extractedStreet: "address.street",
          extractedCity: "address.city",
          extractedTheme: "metadata.settings.theme",
        };

        const result = remapObject(testData, mapping);

        expect(result).toEqual({
          ...testData,
          extractedStreet: "123 Main St",
          extractedCity: "New York",
          extractedTheme: "dark",
        });
      });

      it("should extract array elements using dot notation", () => {
        const mapping: ObjectMapping<typeof testData> = {
          firstHobby: "hobbies[0]",
          lastHobby: "hobbies[2]",
          secondScore: "scores[1]",
          firstTag: "metadata.tags[0]",
        };

        const result = remapObject(testData, mapping);

        expect(result).toEqual({
          ...testData,
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

        const result = remapObject(testData, mapping);

        expect(result).toEqual({
          ...testData,
          allHobbies: ["reading", "swimming", "coding"],
          allScores: [85, 92, 78, 96],
          allTags: ["user", "premium"],
        });
      });
    });

    describe("function-based mapping", () => {
      it("should support function-based transformations", () => {
        const mapping: ObjectMapping<typeof testData> = {
          upperCaseName: (data) => data.name.toUpperCase(),
          hobbyCount: (data) => data.hobbies.length,
          isAdult: (data) => data.age >= 18,
        };

        const result = remapObject(testData, mapping);

        expect(result).toEqual({
          ...testData,
          upperCaseName: "JOHN DOE",
          hobbyCount: 3,
          isAdult: true,
        });
      });

      it("should handle complex function transformations", () => {
        const mapping: ObjectMapping<typeof testData> = {
          fullInfo: (data) => `${data.name} (${data.age})`,
          averageScore: (data) =>
            data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
          addressSummary: (data) =>
            `${data.address.city}, ${data.address.country}`,
        };

        const result = remapObject(testData, mapping);

        expect(result).toEqual({
          ...testData,
          fullInfo: "John Doe (30)",
          averageScore: 87.75,
          addressSummary: "New York, USA",
        });
      });
    });

    describe("mixed mapping types", () => {
      it("should handle mixed dot notation and function mappings", () => {
        const mapping: ObjectMapping<typeof testData> = {
          // Dot notation extractions
          extractedName: "name",
          extractedStreet: "address.street",
          firstHobby: "hobbies[0]",
          // Function-based transformations
          upperCaseName: (data) => data.name.toUpperCase(),
          isAdult: (data) => data.age >= 18,
        };

        const result = remapObject(testData, mapping);

        expect(result).toEqual({
          ...testData,
          extractedName: "John Doe",
          extractedStreet: "123 Main St",
          firstHobby: "reading",
          upperCaseName: "JOHN DOE",
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

        const result = remapObject(testData, mapping);

        expect(result).toEqual({
          ...testData,
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

        const result = remapObject(emptyData, mapping);

        expect(result).toEqual({
          anything: undefined,
          somethingElse: {},
        });
      });

      it("should handle null and undefined values in data", () => {
        const dataWithNulls = {
          name: "John",
          nullValue: null,
          undefinedValue: undefined,
          nested: {
            value: "test",
            nullNested: null,
          },
        };

        const mapping: ObjectMapping<typeof dataWithNulls> = {
          extractedName: "name",
          extractedNull: "nullValue",
          extractedUndef: "undefinedValue",
          extractedNestedNull: "nested.nullNested",
        };

        const result = remapObject(dataWithNulls, mapping);

        expect(result).toEqual({
          ...dataWithNulls,
          extractedName: "John",
          extractedNull: null,
          extractedUndef: undefined,
          extractedNestedNull: null,
        });
      });
    });

    describe("real-world scenarios", () => {
      it("should handle API response enrichment", () => {
        const apiResponse = {
          user_id: 123,
          user_name: "john_doe",
          user_profile: {
            first_name: "John",
            last_name: "Doe",
            contact_info: {
              email: "john@example.com",
              phone: "+1234567890",
            },
          },
          preferences: {
            theme: "dark",
            notifications: ["email", "push"],
          },
          last_activity: "2023-12-01T10:30:00Z",
        };

        // Add computed fields while preserving original structure
        const mapping: ObjectMapping<typeof apiResponse> = {
          // Extract and rename some fields
          id: "user_id",
          username: "user_name",
          email: "user_profile.contact_info.email",
          // Add computed fields
          fullName: (data) =>
            `${data.user_profile.first_name} ${data.user_profile.last_name}`,
          displayName: (data) => data.user_profile.first_name,
          hasNotifications: (data) => data.preferences.notifications.length > 0,
        };

        const result = remapObject(apiResponse, mapping);

        expect(result).toEqual({
          ...apiResponse, // All original fields preserved
          // Plus new computed/extracted fields
          id: 123,
          username: "john_doe",
          email: "john@example.com",
          fullName: "John Doe",
          displayName: "John",
          hasNotifications: true,
        });
      });

      it("should handle data transformation with field overrides", () => {
        const rawData = {
          status: "active",
          count: "42", // String that should be converted to number
          tags: "user,premium", // String that should be split to array
          metadata: {
            created: "2023-01-01",
            score: 85.5,
          },
        };

        const mapping: ObjectMapping<typeof rawData> = {
          // Override existing fields with transformed values
          count: (data) => parseInt(data.count, 10),
          tags: (data) => data.tags.split(","),
          // Add new computed fields
          isActive: (data) => data.status === "active",
          scoreGrade: (data) =>
            data.metadata.score >= 90
              ? "A"
              : data.metadata.score >= 80
                ? "B"
                : "C",
        };

        const result = remapObject(rawData, mapping);

        expect(result).toEqual({
          ...rawData,
          count: 42, // Overridden with number
          tags: ["user", "premium"], // Overridden with array
          isActive: true, // New field
          scoreGrade: "B", // New field
        });
      });
    });
  });
});
