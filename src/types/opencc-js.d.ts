declare module "opencc-js" {
  export interface ConverterOptions {
    from?: "cn" | "tw" | "hk" | "twp" | "jp" | "t";
    to?: "cn" | "tw" | "hk" | "twp" | "jp" | "t";
    dictText?: string[];
  }

  export function Converter(options: ConverterOptions): (text: string) => string;
  export function CustomConverter(dict: [string, string][]): (text: string) => string;
  export function HTMLConverter(
    converter: (text: string) => string,
    rootNode: Element,
    langAttrInitial?: string,
    langAttrNew?: string
  ): { convert: () => void; restore: () => void };
}
