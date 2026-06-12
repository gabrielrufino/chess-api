import { Public, IS_PUBLIC_KEY } from './public.decorator';

describe(Public.name, () => {
  it('should set IS_PUBLIC_KEY metadata to true', () => {
    class TestClass {
      @Public()
      testMethod() {}
    }

    const metadata = Reflect.getMetadata(
      IS_PUBLIC_KEY,
      // eslint-disable-next-line @typescript-eslint/unbound-method
      TestClass.prototype.testMethod,
    ) as boolean;
    expect(metadata).toBe(true);
  });
});
