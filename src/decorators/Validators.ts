import { _validationRegistry, ValidationRule } from './metadata';

function addRule(target: any, propertyKey: string, rule: ValidationRule) {
    const ctor = target.constructor;
    if (!_validationRegistry.has(ctor)) {
        _validationRegistry.set(ctor, {});
    }
    const rules = _validationRegistry.get(ctor)!;
    if (!rules[propertyKey]) {
        rules[propertyKey] = [];
    }
    rules[propertyKey].push(rule);
}

export function Required(message?: string) {
    return function (target: any, propertyKey: string) {
        addRule(target, propertyKey, { type: 'required', message });
    };
}

export function MaxLength(value: number, message?: string) {
    return function (target: any, propertyKey: string) {
        addRule(target, propertyKey, { type: 'maxLength', value, message });
    };
}

export function MinLength(value: number, message?: string) {
    return function (target: any, propertyKey: string) {
        addRule(target, propertyKey, { type: 'minLength', value, message });
    };
}

export function Min(value: number, message?: string) {
    return function (target: any, propertyKey: string) {
        addRule(target, propertyKey, { type: 'min', value, message });
    };
}

export function Max(value: number, message?: string) {
    return function (target: any, propertyKey: string) {
        addRule(target, propertyKey, { type: 'max', value, message });
    };
}
