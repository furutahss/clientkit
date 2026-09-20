import {
  findIdField,
  lowerFirst,
  prismaScalarToTs,
  toKebabCase,
  type PrismaModel,
} from "@/lib/prisma-schema-parser";

export type NamingStyle = "prefix-i" | "suffix-interface";

export interface RepoCodegenOptions {
  namingStyle: NamingStyle;
  useAsyncAwait: boolean;
  includeReturnTypes: boolean;
}

export interface RepoCodegenResult {
  interfaceFileName: string;
  interfaceCode: string;
  implementationFileName: string;
  implementationCode: string;
  controllerFileName: string;
  controllerCode: string;
}

function names(modelName: string, style: NamingStyle) {
  const interfaceName =
    style === "prefix-i"
      ? `I${modelName}Repository`
      : `${modelName}RepositoryInterface`;
  const className =
    style === "prefix-i" ? `${modelName}Repository` : `Prisma${modelName}Repository`;
  return { interfaceName, className };
}

function returnType(includeReturnTypes: boolean, type: string): string {
  return includeReturnTypes ? `: Promise<${type}>` : "";
}

function methodBody(useAsyncAwait: boolean, expression: string): string {
  return useAsyncAwait
    ? `    return await ${expression};`
    : `    return ${expression};`;
}

function methodSignature(useAsyncAwait: boolean): string {
  return useAsyncAwait ? "async " : "";
}

/**
 * schema.prisma のmodel定義から、Repositoryインターフェース・PrismaClient実装クラス・
 * Express用の利用例コードの3点セットを生成する。
 */
export function generateRepositoryCode(
  model: PrismaModel,
  options: RepoCodegenOptions
): RepoCodegenResult {
  const { namingStyle, useAsyncAwait, includeReturnTypes } = options;
  const { interfaceName, className } = names(model.name, namingStyle);
  const modelName = model.name;
  const idField = findIdField(model);
  const idName = idField?.name ?? "id";
  const idTsType = idField ? prismaScalarToTs(idField.type) : "string";
  const rt = (type: string) => returnType(includeReturnTypes, type);
  const asyncKw = methodSignature(useAsyncAwait);
  const instanceName = lowerFirst(modelName);
  const resourcePath = `${toKebabCase(modelName)}s`;

  const interfaceCode = `import type { Prisma, ${modelName} } from "@prisma/client";

/**
 * ${modelName} に対するデータアクセスの抽象定義。
 * 実装をPrismaClient以外（テスト用モックなど）に差し替えられるようにする。
 */
export interface ${interfaceName} {
  findUnique(${idName}: ${idTsType})${rt(`${modelName} | null`)};
  findMany(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.${modelName}WhereInput;
    orderBy?: Prisma.${modelName}OrderByWithRelationInput;
  })${rt(`${modelName}[]`)};
  create(data: Prisma.${modelName}CreateInput)${rt(modelName)};
  update(${idName}: ${idTsType}, data: Prisma.${modelName}UpdateInput)${rt(modelName)};
  delete(${idName}: ${idTsType})${rt(modelName)};
}
`;

  const implementationCode = `import type { PrismaClient, Prisma, ${modelName} } from "@prisma/client";

import type { ${interfaceName} } from "./${interfaceName}";

/**
 * PrismaClientを利用した ${interfaceName} の実装クラス。
 * PrismaClientはコンストラクタで注入する（依存性注入パターン）。
 */
export class ${className} implements ${interfaceName} {
  constructor(private readonly prisma: PrismaClient) {}

  ${asyncKw}findUnique(${idName}: ${idTsType})${rt(`${modelName} | null`)} {
${methodBody(
    useAsyncAwait,
    `this.prisma.${instanceName}.findUnique({ where: { ${idName} } })`
  )}
  }

  ${asyncKw}findMany(params?: {
    skip?: number;
    take?: number;
    where?: Prisma.${modelName}WhereInput;
    orderBy?: Prisma.${modelName}OrderByWithRelationInput;
  })${rt(`${modelName}[]`)} {
${methodBody(
    useAsyncAwait,
    `this.prisma.${instanceName}.findMany({\n      skip: params?.skip,\n      take: params?.take,\n      where: params?.where,\n      orderBy: params?.orderBy,\n    })`
  )}
  }

  ${asyncKw}create(data: Prisma.${modelName}CreateInput)${rt(modelName)} {
${methodBody(useAsyncAwait, `this.prisma.${instanceName}.create({ data })`)}
  }

  ${asyncKw}update(${idName}: ${idTsType}, data: Prisma.${modelName}UpdateInput)${rt(modelName)} {
${methodBody(
    useAsyncAwait,
    `this.prisma.${instanceName}.update({ where: { ${idName} }, data })`
  )}
  }

  ${asyncKw}delete(${idName}: ${idTsType})${rt(modelName)} {
${methodBody(
    useAsyncAwait,
    `this.prisma.${instanceName}.delete({ where: { ${idName} } })`
  )}
  }
}
`;

  const controllerCode = `import { Router } from "express";
import { PrismaClient } from "@prisma/client";

import { ${className} } from "./${className}";
import type { ${interfaceName} } from "./${interfaceName}";

// 依存性注入: PrismaClientをRepositoryに、Repositoryをルーターに注入する
const prisma = new PrismaClient();
const ${instanceName}Repository: ${interfaceName} = new ${className}(prisma);

export function create${modelName}Router(repository: ${interfaceName} = ${instanceName}Repository) {
  const router = Router();

  router.get("/${resourcePath}/:id", async (req, res) => {
    const item = await repository.findUnique(req.params.id as ${idTsType});
    if (!item) {
      res.status(404).json({ message: "${modelName} not found" });
      return;
    }
    res.json(item);
  });

  router.get("/${resourcePath}", async (req, res) => {
    const items = await repository.findMany();
    res.json(items);
  });

  router.post("/${resourcePath}", async (req, res) => {
    const created = await repository.create(req.body);
    res.status(201).json(created);
  });

  router.put("/${resourcePath}/:id", async (req, res) => {
    const updated = await repository.update(req.params.id as ${idTsType}, req.body);
    res.json(updated);
  });

  router.delete("/${resourcePath}/:id", async (req, res) => {
    await repository.delete(req.params.id as ${idTsType});
    res.status(204).send();
  });

  return router;
}

export const ${instanceName}Router = create${modelName}Router();
`;

  return {
    interfaceFileName: `${interfaceName}.ts`,
    interfaceCode,
    implementationFileName: `${className}.ts`,
    implementationCode,
    controllerFileName: `${instanceName}.controller.ts`,
    controllerCode,
  };
}

export const SAMPLE_PRISMA_MODEL = `model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  String
  author    User     @relation(fields: [authorId], references: [id])
  createdAt DateTime @default(now())
}
`;
