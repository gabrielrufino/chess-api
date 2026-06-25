import { PaginationQueryDto } from './pagination-query.dto';

describe(PaginationQueryDto.name, () => {
  it('should be defined when instantiated', () => {
    const dto = new PaginationQueryDto();
    expect(dto).toBeDefined();
  });

  it('should have default skip value of 0', () => {
    const dto = new PaginationQueryDto();
    expect(dto.skip).toBe(0);
  });

  it('should have default limit value of 10', () => {
    const dto = new PaginationQueryDto();
    expect(dto.limit).toBe(10);
  });

  it('should allow overriding skip and limit', () => {
    const dto = new PaginationQueryDto();
    dto.skip = 5;
    dto.limit = 25;
    expect(dto.skip).toBe(5);
    expect(dto.limit).toBe(25);
  });
});
